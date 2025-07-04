import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  List,
  Link,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import Onboarding from "../components/Onboarding";

export default function Index() {
  return (
    <Page>
      <TitleBar title="Shop chat agent reference app">
      </TitleBar>
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Congrats on creating a new Shopify app 🎉
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This is a reference app that adds a chat agent on your storefront, which is powered via claude and can connect shopify mcp platform.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
        <Onboarding />
      </BlockStack>
    </Page>
  );
}
