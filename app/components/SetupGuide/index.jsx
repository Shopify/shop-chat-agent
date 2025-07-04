import { useState, useId } from "react";
import {
  BlockStack,
  Card,
  Text,
  InlineStack,
  ButtonGroup,
  Button,
  ProgressBar,
  Box,
  Collapsible,
  Icon,
  Popover,
  ActionList,
} from "@shopify/polaris";
import {
  MenuHorizontalIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  XIcon,
} from "@shopify/polaris-icons";
import { SetupItem } from "./SetupGuide";

export const SetupGuide = ({ onForceComplete, items, setExpanded, handleSubmit, handleDismiss }) => {
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [popoverActive, setPopoverActive] = useState(false);

  const accessId = useId();
  const completedItemsLength = items.filter((item) => item.complete).length;

  return (
    <Card padding="0">
      <Box padding="400" paddingBlockEnd="400">
        <BlockStack>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">
              Setup Guide
            </Text>
            <ButtonGroup gap="tight" noWrap>
              <Popover
                active={popoverActive}
                onClose={() => setPopoverActive((prev) => !prev)}
                activator={
                  <Button
                    onClick={() => setPopoverActive((prev) => !prev)}
                    variant="tertiary"
                    icon={MenuHorizontalIcon}
                  />
                }
              >
                <ActionList
                  actionRole="menuitem"
                  items={[
                    {
                      content: "Dismiss",
                      onAction: ()=>handleDismiss(),
                      prefix: (
                        <div
                          style={{
                            height: "1rem",
                            width: "1rem",
                            paddingTop: ".05rem",
                          }}
                        >
                          <Icon tone="subdued" source={XIcon} />
                        </div>
                      ),
                    },
                  ]}
                />
              </Popover>

              <Button
                variant="tertiary"
                icon={isGuideOpen ? ChevronUpIcon : ChevronDownIcon}
                onClick={() => {
                  setIsGuideOpen(!isGuideOpen);
                }}
                ariaControls={accessId}
              />
            </ButtonGroup>
          </InlineStack>
          <Text as="p" variant="bodyMd">
            CUse personalized guide to get your app up and running
          </Text>
          <div style={{ marginTop: ".8rem" }}>
            <InlineStack blockAlign="center" gap="200">
              {completedItemsLength === items.length ? (
                <div style={{ maxHeight: "1rem" }}>
                  <InlineStack wrap={false} gap="100">
                    <Icon
                      source={CheckIcon}
                      tone="subdued"
                      accessibilityLabel="Check icon to indicate completion of Setup Guide"
                    />
                    <Text as="p" variant="bodySm" tone="subdued">
                      Done
                    </Text>
                  </InlineStack>
                </div>
              ) : (
                <Text as="span" variant="bodySm">
                  {`${completedItemsLength} / ${items.length} completed`}
                </Text>
              )}

              {completedItemsLength !== items.length ? (
                <div style={{ width: "100px" }}>
                  <ProgressBar
                    progress={
                      (items.filter((item) => item.complete).length /
                        items.length) *
                      100
                    }
                    size="small"
                    tone="primary"
                    animated
                  />
                </div>
              ) : null}
            </InlineStack>
          </div>
        </BlockStack>
      </Box>
      <Collapsible open={isGuideOpen} id={accessId}>
        <Box padding="200">
          <BlockStack gap="100">
            {items.map((item) => {
              return (
                <SetupItem
                  key={item.id}
                  expanded={item.expanded}
                  setExpanded={() => setExpanded(item.id)}
                  onComplete={onForceComplete}
                  handleDismiss={handleDismiss}
                  handleSubmit={handleSubmit}
                  {...item}
                />
              );
            })}
          </BlockStack>
        </Box>
      </Collapsible>
      {completedItemsLength === items.length ? (
        <Box
          background="bg-surface-secondary"
          borderBlockStartWidth="025"
          borderColor="border-secondary"
          padding="300"
        >
          <InlineStack align="end">
            <Button onClick={() => handleDismiss()}>Dismiss Guide</Button>
          </InlineStack>
        </Box>
      ) : null}
    </Card>
  );
};