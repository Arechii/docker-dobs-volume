import process from "process";
import Server from "./server";

const server = new Server();

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  server.shutdown();
});