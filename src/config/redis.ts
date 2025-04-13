import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on("connect", () => {
  console.log("Connected Redis");
});

redis.on("error", (err) => {
  console.log("Redis Error", err);
});

export default redis;
