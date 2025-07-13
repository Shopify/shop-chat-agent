import {
  BlockStack,
  Box,
  Card,
  Divider,
  Icon,
  InlineStack,
  Text,
} from "@shopify/polaris";
import "./suggestion.css";
import { useNavigate } from "@remix-run/react";

export const TopUnansweredQuestions = ({ unansweredQuestions }) => {
  const navigate = useNavigate();

  return (
    <BlockStack gap="200">
      <Text as="h3" variant="headingMd">
        Top Unanswered Questions
      </Text>
      <Card>
        <div style={{ height: "312px", overflowY: "auto" }}>
          <BlockStack gap="150">
            {unansweredQuestions.map((question, index) => (
              <div key={question.id}>
                <button
                  className="suggestion"
                  onClick={() => {
                    navigate(`/app/faq/${question.id}`);
                  }}
                >
                  <Box padding="300" width="100%">
                    <InlineStack gap="200" align="start">
                      <div>
                        <Icon
                          source={() => (
                            <svg
                              viewBox="1 1 18 18"
                              ariaHidden="true"
                              focusable="false"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7 15v-2.291a3 3 0 0 1-2.5-2.959v-1.25a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v1.25a3 3 0 0 1-3 3h-2.461l-3.039 2.25Zm3.534-.75h1.966a4.5 4.5 0 0 0 4.5-4.5v-1.25a4.5 4.5 0 0 0-4.5-4.5h-5a4.5 4.5 0 0 0-4.5 4.5v1.25a4.498 4.498 0 0 0 2.5 4.032v1.218a1.5 1.5 0 0 0 2.393 1.206l2.64-1.956Zm-4.534-6.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm.75 2a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z"
                              ></path>
                            </svg>
                          )}
                        />
                      </div>
                      <Text key={question.id}>{question.question}</Text>
                    </InlineStack>
                  </Box>
                </button>

                {index !== unansweredQuestions.length - 1 && <Divider />}
              </div>
            ))}
          </BlockStack>
        </div>
      </Card>
    </BlockStack>
  );
};
