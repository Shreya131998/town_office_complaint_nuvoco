/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large file uploads (photo + video)
  experimental: {},
  serverExternalPackages: ['formidable', 'nodemailer'],
};

export default nextConfig;
