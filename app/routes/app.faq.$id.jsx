import {
  Form,
  redirect,
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
import prisma from "../db.server";
import { questions } from "../mockData/questions";
import { authenticate } from "../shopify.server";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const merchant = await prisma.merchant.findUnique({
    where: {
      shop: session.shop,
    },
    select: {
      id: true,
    },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }

  if (params.id && params.id !== "new") {
    const question = await prisma.faq.findUnique({
      where: {
        id,
        merchantId: merchant.id,
      },
    });

    return question;
  }

  return { question: "", answer: "" };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const merchant = await prisma.merchant.findUnique({
    where: {
      shop: session.shop,
    },
    select: {
      id: true,
    },
  });

  if (!merchant) {
    throw new Response("Merchant not found", { status: 404 });
  }
  const formData = await request.formData();
  const question = formData.get("question");
  const answer = formData.get("answer");

  if (id === "new") {
    await prisma.faq.create({
      data: {
        merchantId: merchant.id,
        question,
        answer,
      },
    });
  } else {
    await prisma.faq.update({
      where: { id, merchantId: merchant.id },
      data: {
        question,
        answer,
      },
    });
  }

  return redirect(`/app?shop=${session.shop}`);
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
      <Form method="post">
        <BlockStack gap="800">
          <Card>
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
          </Card>
          <InlineStack align="end">
            <Button
              loading={loading}
              variant="primary"
              submit
              disabled={!question || !answer}
            >
              Save
            </Button>
          </InlineStack>
        </BlockStack>
      </Form>
    </Page>
  );
}
