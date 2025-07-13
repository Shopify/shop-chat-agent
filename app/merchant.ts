import { MerchantStatus } from "@prisma/client";
import prisma from "./db.server";

const defaultFaqs = [
  {
    question: "Do you have a physical store?",
    answer: null,
  },
  {
    question: "Do you offer bulk or wholesale orders?",
    answer: null,
  },
  {
    question: "Do you have active discount codes or promotions?",
    answer: null,
  },
  {
    question: "How can I contact customer service?",
    answer: null,
  },
  {
    question: "Do you offer express shipping?",
    answer: null,
  },
  {
    question: "Do you ship internationally?",
    answer: null,
  },
  {
    question: "Do you offer free shipping?",
    answer: null,
  },
];

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

      await prisma.faq.createMany({
        data: defaultFaqs.map((faq) => ({
          merchantId: merchant.id,
          question: faq.question,
          answer: faq.answer,
        })),
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
