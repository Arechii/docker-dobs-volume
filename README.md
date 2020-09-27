# docker-dobs-volume
 Docker volume plugin for mounting DigitalOcean block storage.

 **This plugin is not production ready!**

 Installation:
 ```
 docker plugin install arechii/docker-dobs-volume DO_TOKEN=<your token> DO_REGION=<region slug>
 ```

 Driver options:
  - name (will be used instead of the volume name for DOBS)
  - size (in GB's; default 1)

 Usage:
 ```
 docker volume create -d arechii/docker-dobs-volume -o size=5 example
 ```
 ```
 volumes:
  example:
    driver: arechii/docker-dobs-volume
    driver_opts:
      size: 5
```