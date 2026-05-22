/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@tremor/react"],
};

module.exports = nextConfig;
