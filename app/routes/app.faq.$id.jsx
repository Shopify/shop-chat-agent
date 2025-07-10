import {
  Form,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import {
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  TextField,
} from "@shopify/polaris";
import { useState } from "react";
import { questions } from "../mockData/questions";

export const loader = async ({ params }) => {
  const { id } = params;
  const question = questions.find((question) => question.id === id);
  return question;
};

export default function Faq() {
  const navigate = useNavigate();
  const data = useLoaderData();

  const [question, setQuestion] = useState(data.question);
  const [answer, setAnswer] = useState(data.answer);
  const navigation = useNavigation();

  const loading = navigation.state === "submitting";

  return (
    <Page
      title="Add new FAQ"
      backAction={{ content: "Back", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="800">
        <Card>
          <Form>
            <BlockStack gap="300">
              <TextField
                label="Question"
                name="question"
                value={question}
                onChange={(value) => setQuestion(value)}
              />

              <TextField
                label="Answer"
                name="answer"
                multiline={6}
                helpText="Provide a brief answer to the question"
                value={answer}
                onChange={(value) => setAnswer(value)}
              />
            </BlockStack>
          </Form>
        </Card>
        <InlineStack align="end">
          <Button
            loading={loading}
            variant="primary"
            onClick={() => navigate("/app")}
            disabled={!question || !answer}
          >
            Save
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
