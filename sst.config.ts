/// <reference path="./.sst/platform/config.d.ts" />

// Portfolio demo hosting: the Next.js web app in demo mode (NEXT_PUBLIC_DEMO_MODE=1,
// set in apps/web/.env.production.local) on Lambda + CloudFront via OpenNext.
// There is no API or database behind it; see apps/web/lib/demo.ts.
export default $config({
  app(input) {
    return {
      name: "freespace-demo",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { aws: { region: "eu-west-1", profile: "freespace" } },
    };
  },
  async run() {
    new sst.aws.Nextjs("Web", {
      path: "apps/web",
      // override: replaces the A records that pointed at the old Lightsail box.
      // Only these two names are touched; the zone's mail records are left alone.
      domain: {
        name: "www.freespace.ie",
        redirects: ["freespace.ie"],
        dns: sst.aws.dns({ override: true }),
      },
    });
  },
});
