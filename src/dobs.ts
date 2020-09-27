import { promises as fs } from "fs";
import { Volume } from "./types";
import axios, { AxiosInstance } from "axios";
import { promisify } from "util";
import child_process from "child_process";

const exec = promisify(child_process.exec);

export default class Dobs {
  token: string;
  region: string;
  api: AxiosInstance;

  constructor() {
    const { DO_TOKEN, DO_REGION } = process.env;

    if (!DO_TOKEN) throw new Error("Environment variable DO_TOKEN is not set");
    if (!DO_REGION) throw new Error("Environment variable DO_REGION is not set");

    this.token = DO_TOKEN;
    this.region = DO_REGION;
    this.api = axios.create({
      baseURL: "https://api.digitalocean.com/v2",
      headers: {
        authorization: `Bearer ${this.token}`
      }
    });
  }

  async getDropletId() {
    return (await axios.get("http://169.254.169.254/metadata/v1.json")).data.droplet_id;
  }

  async getVolume(name: string): Promise<Volume | undefined> {
    return (await this.api.get("/volumes", { params: { region: this.region, name } })).data.volumes[0];
  }

  async create(volumeName: string, dobsName?: string, size: number = 1): Promise<Volume> {
    const name = dobsName ?? volumeName;
    const volume = await this.getVolume(name);
    
    if (volume) return volume;

    return (await this.api.post("/volumes", { region: this.region, name, size_gigabytes: size, filesystem_type: "ext4" })).data.volume;
  }

  async remove(name: string) {
    const volume = await this.getVolume(name);

    if (!volume) return;

    if (volume.droplet_ids && volume.droplet_ids.length) {
      await this.volumeAction("detach", await this.getDropletId(), name);
      await new Promise(res => setTimeout(res, 2000));
    }

    await this.api.delete("/volumes", { params: { region: this.region, name } });
  }

  async mount(name: string, volume: Volume) {
    const dropletId = await this.getDropletId();
    const dobs = await this.getVolume(volume.name);

    if (!dobs) throw new Error("No volume found to mount");

    if (!dobs.droplet_ids || !dobs.droplet_ids.length) {
      await this.volumeAction("attach", dropletId, volume.name);
    } else if (dobs.droplet_ids[0] !== dropletId) {
      await this.volumeAction("detach", dobs.droplet_ids[0], volume.name);
      await new Promise(res => setTimeout(res, 2000));
      await this.volumeAction("attach", dropletId, volume.name);
    }

    const mountpoint = `/mnt/volumes/${name}`;

    await fs.mkdir(mountpoint, { recursive: true });
    await exec(`mount -o defaults,nofail,discard,noatime /dev/disk/by-id/scsi-0DO_Volume_${volume.name} ${mountpoint}`);

    return mountpoint;
  }

  async unmount(name: string, volume: Volume) {
    await exec(`umount /mnt/volumes/${name}`);
    await new Promise(res => setTimeout(res, 2000));
    await this.volumeAction("detach", await this.getDropletId(), volume.name);
  }

  async volumeAction(type: "attach" | "detach", dropletId: string, volume: string) {
    const data = { type, droplet_id: dropletId, volume_name: volume, region: this.region };
    const res = (await this.api.post("/volumes/actions", data)).data.action as { status: "in-progress" | "completed" | "errored" };

    if (res.status === "errored") throw new Error(`Volume ${type === "attach" ? "attachment" : "detachment"} failed`);
  }
}