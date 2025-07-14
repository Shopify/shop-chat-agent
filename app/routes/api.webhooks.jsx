import { authenticate } from "../shopify.server";
import db from "../db.server";
import { MerchantStatus } from "@prisma/client";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
        await db.merchant.update({
          where: { shop },
          data: { status: MerchantStatus.INACTIVE },
        });
      }
      break;
    case "SHOP_REDACT":
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      return new Response(null, { status: 200 });
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};
