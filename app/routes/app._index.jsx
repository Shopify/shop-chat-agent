import { Page, Layout, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import Onboarding from "../components/Onboarding";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { TopUnansweredQuestions } from "../components/TopUnansweredQuestions";
import { questions } from "../mockData/questions";
import { FaqLogs } from "../components/FaqLogs";

export const loader = async () => {
  return {
    env: {
      THEME_EXTENSION_ID: process.env.THEME_EXTENSION_ID,
      THEME_APP_EXTENSION_NAME: process.env.THEME_APP_EXTENSION_NAME,
    },
    unansweredQuestions: questions.slice(0, 7),
  };
};

export default function Index() {
  const { env, unansweredQuestions } = useLoaderData();
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
            <FaqLogs />
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
