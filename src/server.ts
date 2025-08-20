import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import soap from "soap";
import { makeSmapiService } from "./smapi/service.js";
import oauthRouter from "./auth/oauth.js";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "4000", 10);

const app = express();
app.use(oauthRouter);

app.get("/wsdl", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "wsdl", "musicService.wsdl"));
});

const server = http.createServer(app);

const wsdlPath = path.join(__dirname, "..", "wsdl", "musicService.wsdl");
const service = makeSmapiService();

// Load WSDL XML content explicitly and pass it to soap.listen (more reliable than path-based loading)
const xml = fs.readFileSync(wsdlPath, "utf8");
soap.listen(server, "/smapi", service as any, xml, () => {
  console.log("SMAPI SOAP service mounted at /smapi");
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WSDL: http://localhost:${PORT}/wsdl`);
  console.log(`Authorize URL: http://localhost:${PORT}/oauth/authorize?client_id=sonos-sample&redirect_uri=http://localhost:${PORT}/dummy-callback`);
});
