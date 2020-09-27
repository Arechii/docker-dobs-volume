import { Server as HttpServer } from "http";
import { Volume } from "./types";
import express, { Request, Response } from "express";
import Dobs from "./dobs";

export default class Server {
  dobs: Dobs;
  app: express.Express;
  server: HttpServer;
  volumes: Map<string, Volume> = new Map();

  constructor() {
    this.dobs = new Dobs();
    this.app = express();

    this.app.use(express.json({ strict: false, type: _req => true }));
    this.app.use(async (req, _res, next) => {
      console.log(`[${req.method}] ${req.path}: ${JSON.stringify(req.body)}`);
      next();
    });

    this.app.post("/Plugin.Activate", this.activate.bind(this));
    this.app.post("/VolumeDriver.Create", this.create.bind(this));
    this.app.post("/VolumeDriver.Remove", this.remove.bind(this));
    this.app.post("/VolumeDriver.Mount", this.mount.bind(this));
    this.app.post("/VolumeDriver.Path", this.path.bind(this));
    this.app.post("/VolumeDriver.Unmount", this.unmount.bind(this));
    this.app.post("/VolumeDriver.Get", this.get.bind(this));
    this.app.post("/VolumeDriver.List", this.list.bind(this));
    this.app.post("/VolumeDriver.Capabilities", this.capabilities.bind(this));

    this.server = this.app.listen("/run/docker/plugins/dobs.sock");
  }

  activate(_req: Request, res: Response) {
    res.json({ Implements: ["VolumeDriver"] });
  }

  async create(req: Request, res: Response) {
    const options = req.body as { Name: string, Opts?: { name?: string, size?: string } };

    try {
      if (this.volumes.has(options.Name)) return this.volumes.get(options.Name);

      const volume = await this.dobs.create(options.Name, options.Opts?.name, Number(options.Opts?.size ?? 1));
      
      this.volumes.set(options.Name, volume);
    } catch (err) {
      return res.json({ Err: err.message });
    }
    
    res.json({ Err: "" });
  }

  async remove(req: Request, res: Response) {
    const options = req.body as { Name: string };
    const volume = this.volumes.get(options.Name);

    if (!volume) return res.json({ Err: "Volume not found" });

    try {
      await this.dobs.remove(volume.name);
      this.volumes.delete(options.Name);
    } catch (err) {
      return res.json({ Err: err.message });
    }

    res.json({ Err: "" });
  }

  async mount(req: Request, res: Response) {
    const options = req.body as { Name: string, ID: string };
    const volume = this.volumes.get(options.Name);

    if (!volume) return res.json({ Err: "Volume not found" });

    try {
      let mountpoint = await this.dobs.mount(options.Name, volume);
      return res.json({ Mountpoint: mountpoint, Err: "" });
    } catch (err) {
      return res.json({ Err: err.message });
    }
  }

  path(req: Request, res: Response) {
    const options = req.body as { Name: string };

    res.json({ Mountpoint: `/mnt/volumes/${options.Name}`, Err: "" });
  }

  async unmount(req: Request, res: Response) {
    const options = req.body as { Name: string, ID: string };
    const volume = this.volumes.get(options.Name);

    if (!volume) return res.json({ Err: "Volume not found" });

    try {
      await this.dobs.unmount(options.Name, volume);
    } catch (err) {
      return res.json({ Err: err.message });
    }

    res.json({ Err: "" });
  }

  get(req: Request, res: Response) {
    const options = req.body as { Name: string };
    const volume = this.volumes.get(options.Name);

    if (!volume) return res.json({ Err: "Volume not found" });

    res.json({
      Volume: {
        Name: options.Name,
        Mountpoint: `/mnt/volumes/${options.Name}`,
        Status: {}
      },
      Err: ""
    });
  }

  list(_req: Request, res: Response) {
    const volumes = [];

    for (const [key] of this.volumes)
      volumes.push({ Name: key, Mountpoint: `/mnt/volumes/${key}` });

    res.json({
      Volumes: volumes,
      Err: ""
    });
  }

  capabilities(_req: Request, res: Response) {
    res.json({ Capabilities: { Scope: "global" } });
  }

  shutdown() {
    this.server.close();
    console.log("Shutdown");
  }
}