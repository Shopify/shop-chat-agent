import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { MerchantStatus } from "@prisma/client";
import { authenticate } from "app/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }

  const merchant = await prisma.merchant.findUnique({
    where: {
      shop,
    },
  });

  if (merchant) {
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { 
        status: MerchantStatus.INACTIVE,
      },
    });
  }

  return new Response();
};
