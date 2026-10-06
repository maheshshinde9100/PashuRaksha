import { fileURLToPath } from "node:url";
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,

  // Pin Turbopack's package/lockfile resolution to this app's absolute directory.
  //
  // A parent directory (e.g. C:\Users\MAHESH) can contain a stray package-lock.json
  // that lives outside the current Git repo root, which by default causes
  //   "Next.js ignored package-lock.json in C:\Users\MAHESH because it is outside
  //    the current Git repository (…\my-next-app). To use this directory, set
  //    turbopack.root in your Next.js config."
  //
  // Setting an absolute path here removes the warning entirely.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
