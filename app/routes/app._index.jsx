export default function Index() {
  return (
    <s-page>
      <ui-title-bar title="Shop chat agent reference app" />

      <s-section>
        <s-stack gap="base">
          <s-heading>Congrats on creating a new Shopify app 🎉</s-heading>
          <s-paragraph>
            This is a reference app that adds a chat agent on your storefront,
            which is powered via claude and can connect shopify mcp platform.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section heading="App template specs" slot="aside">
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>API: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/admin-graphql"
            target="_blank"
          >
            GraphQL
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://www.prisma.io/" target="_blank">
            Prisma
          </s-link>
        </s-paragraph>
      </s-section>

      <s-section heading="Next steps" slot="aside">
        <s-text>Enable the theme extension in your theme editor.</s-text>
      </s-section>
    </s-page>
  );
}
