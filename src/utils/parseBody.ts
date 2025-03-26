import { IncomingMessage } from "http";

export async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        if (req.headers["content-type"] !== "application/json") {
          return reject("Unsupported content type");
        }
        resolve(JSON.parse(body));
      } catch (err) {
        reject(`Invalid JSON - ${err}`);
      }
    });

    req.on("error", (err) => {
      reject(`Error receiving data - ${err}`);
    });
  });
}
