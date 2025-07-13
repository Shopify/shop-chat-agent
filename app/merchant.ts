import { MerchantStatus } from "@prisma/client";
import prisma from "./db.server";

export const initMerchant = async (shop: string) => {
  console.log("initMerchant", shop);
  try {
    let merchant = await prisma.merchant.findUnique({
      where: {
        shop,
      },
    });

    if (!merchant) {
      const merchant = await prisma.merchant.create({
        data: {
          shop,
          status: MerchantStatus.ACTIVE,
        },
      });

      return merchant.id;
    } else {
      await prisma.merchant.update({
        where: {
          id: merchant.id,
        },
        data: {
          shop,
          status: MerchantStatus.ACTIVE,
        },
      });

      return merchant.id;
    }
  } catch (error) {
    console.error("Error initializing merchant", error);
    return null;
  }
};
