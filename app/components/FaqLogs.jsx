import { useNavigate } from "@remix-run/react";
import {
  BlockStack,
  EmptyState,
  Text,
  Card,
  Tabs,
  IndexTable,
  Link,
  useIndexResourceState,
  Box,
} from "@shopify/polaris";
import { useState, useMemo } from "react";

export const FaqLogs = ({ logs }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const navigate = useNavigate();

  // Filter logs based on selected tab
  const filteredLogs = useMemo(() => {
    switch (selectedTab) {
      case 0: // All
        return logs;
      case 1: // Answered
        return logs.filter((log) => log.answer);
      case 2: // Unanswered
        return logs.filter((log) => !log.answer);
      default:
        return logs;
    }
  }, [logs, selectedTab]);

  // IndexTable resource state
  const resourceName = {
    singular: "FAQ log",
    plural: "FAQ logs",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(filteredLogs);

  const tabs = [
    {
      id: "all-tab",
      content: `All`,
      accessibilityLabel: "All FAQ logs",
      panelID: "all-tab-content",
    },
    {
      id: "answered-tab",
      content: `Answered`,
      accessibilityLabel: "Answered FAQ logs",
      panelID: "answered-tab-content",
    },
    {
      id: "unanswered-tab",
      content: `Unanswered`,
      accessibilityLabel: "Unanswered FAQ logs",
      panelID: "unanswered-tab-content",
    },
  ];

  const rowMarkup = filteredLogs.map((faq, index) => (
    <IndexTable.Row
      id={faq.id}
      key={faq.id}
      selected={selectedResources.includes(faq.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {faq.question}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Box width="20ch">
          <Text variant="bodyMd" as="span" truncate>
            {faq.answer ? (
              <Link
                onClick={() => {
                  navigate(`/app/faq/${faq.id}`);
                }}
              >
                {faq.answer}
              </Link>
            ) : (
              <Text variant="bodyMd" as="span" truncate tone="critical">
                Unanswered
              </Text>
            )}
          </Text>
        </Box>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {console.log(faq)}
        <Text variant="bodyMd" as="span">
          {new Date(faq.createdAt)
            .toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
            .replace(/(\d+),/, (match, p1) => {
              const day = parseInt(p1, 10);
              let suffix = "th";
              if (day % 10 === 1 && day % 100 !== 11) suffix = "st";
              else if (day % 10 === 2 && day % 100 !== 12) suffix = "nd";
              else if (day % 10 === 3 && day % 100 !== 13) suffix = "rd";
              return ` ${day}${suffix},`;
            })}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  if (logs.length === 0) {
    return (
      <BlockStack gap="200">
        <Text as="h3" variant="headingMd">
          FAQ Logs
        </Text>
        <Card>
          <EmptyState
            image="https://cdn.shopify.com/b/shopify-brochure2-assets/893cc27413970e872182a200ad6ec8c4.svg"
            heading="Queries about your store will show here"
          >
            <p>
              This is where you'll view what info shoppers are searching for and
              the responses Shopify sends to AI agents when shoppers ask about
              your store.
            </p>
          </EmptyState>
        </Card>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingMd">
        FAQ Logs
      </Text>
      <Card padding="0">
        <div
          style={{
            minHeight: "395px",
          }}
        >
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            <IndexTable
              resourceName={resourceName}
              itemCount={filteredLogs.length}
              selectedItemsCount={
                allResourcesSelected ? "All" : selectedResources.length
              }
              selectable={false}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Query" },
                { title: "Matched to" },
                { title: "Date" },
              ]}
              emptyState={
                <EmptyState
                  heading="No logs found"
                  image="https://cdn.shopify.com/b/shopify-brochure2-assets/893cc27413970e872182a200ad6ec8c4.svg"
                >
                  <p>No FAQ logs match the selected filter.</p>
                </EmptyState>
              }
            >
              {rowMarkup}
            </IndexTable>
          </Tabs>
        </div>
      </Card>
    </BlockStack>
  );
};
