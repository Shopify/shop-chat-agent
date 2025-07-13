import { Page, Layout, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import Onboarding from "../components/Onboarding";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { TopUnansweredQuestions } from "../components/TopUnansweredQuestions";
import { FaqLogs } from "../components/FaqLogs";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const merchant = await prisma.merchant.findUnique({
    where: {
      shop: session.shop,
    },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  const [unansweredQuestions, logs] = await Promise.all([
    prisma.faq.findMany({
      where: {
        merchantId: merchant.id,
        answer: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 7,
    }),
    prisma.faq.findMany({
      where: {
        merchantId: merchant.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    }),
  ]);

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  return {
    env: {
      THEME_EXTENSION_ID: process.env.THEME_EXTENSION_ID,
      THEME_APP_EXTENSION_NAME: process.env.THEME_APP_EXTENSION_NAME,
    },
    unansweredQuestions,
    logs,
  };
};

export default function Index() {
  const { env, unansweredQuestions, logs } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page
      primaryAction={{
        content: "Add FAQ",
        onAction: () => navigate("/app/faq/new"),
      }}
      fullWidth
    >
      <TitleBar title="Shop chat agent reference app"></TitleBar>
      <BlockStack gap="500">
        <Onboarding
          THEME_EXTENSION_ID={env.THEME_EXTENSION_ID}
          THEME_APP_EXTENSION_NAME={env.THEME_APP_EXTENSION_NAME}
        />

        <Layout>
          <Layout.Section variant="oneThird">
            <TopUnansweredQuestions unansweredQuestions={unansweredQuestions} />
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <FaqLogs logs={logs} />
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
