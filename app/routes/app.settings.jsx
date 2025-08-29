import { useState, useCallback, useEffect } from 'react';
import { json } from '@remix-run/node';
import { useLoaderData, useActionData, Form } from '@remix-run/react';
import { Page, Card, Layout, FormLayout, Select, TextField, Button, Banner } from '@shopify/polaris';
import { authenticate } from '../shopify.server';
import { getShopSettings, updateShopSettings } from '../services/settings.server.js';

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return json({
    shop: session.shop,
    llmProvider: settings?.llmProvider || process.env.LLM_PROVIDER || 'claude',
    isClaudeKeySet: !!settings?.claudeApiKey,
    isOpenaiKeySet: !!settings?.openaiApiKey,
    isGeminiKeySet: !!settings?.geminiApiKey,
    isGroqKeySet: !!settings?.groqApiKey,
    isOpenrouterKeySet: !!settings?.openrouterApiKey,
  });
};

export const action = async ({ request }) => {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const llmProvider = formData.get('llmProvider');
    const claudeApiKey = formData.get('claudeApiKey');
    const openaiApiKey = formData.get('openaiApiKey');
    const geminiApiKey = formData.get('geminiApiKey');
    const groqApiKey = formData.get('groqApiKey');
    const openrouterApiKey = formData.get('openrouterApiKey');

    const settings = {
      llmProvider,
      ...(claudeApiKey && { claudeApiKey }),
      ...(openaiApiKey && { openaiApiKey }),
      ...(geminiApiKey && { geminiApiKey }),
      ...(groqApiKey && { groqApiKey }),
      ...(openrouterApiKey && { openrouterApiKey }),
    };

    try {
      await updateShopSettings(session.shop, settings);
      return json({ success: true });
    } catch (error) {
      console.error('Error updating settings:', error);
      return json({ success: false, error: 'Failed to save settings.' }, { status: 500 });
    }
  };

export default function SettingsPage() {
  const { llmProvider: initialProvider, ...keyStatuses } = useLoaderData();
  const actionData = useActionData();

  const [llmProvider, setLlmProvider] = useState(initialProvider);
  const [apiKey, setApiKey] = useState('');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (actionData?.success) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const handleLlmProviderChange = useCallback((value) => {
    setLlmProvider(value);
    setApiKey('');
  }, []);

  const providerOptions = [
    { label: 'Claude', value: 'claude' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'Gemini', value: 'gemini' },
    { label: 'Groq', value: 'groq' },
    { label: 'OpenRouter', value: 'openrouter' },
  ];

  const getApiKeyInfo = () => {
    switch (llmProvider) {
      case 'claude':
        return { name: 'claudeApiKey', isSet: keyStatuses.isClaudeKeySet };
      case 'openai':
        return { name: 'openaiApiKey', isSet: keyStatuses.isOpenaiKeySet };
      case 'gemini':
        return { name: 'geminiApiKey', isSet: keyStatuses.isGeminiKeySet };
      case 'groq':
        return { name: 'groqApiKey', isSet: keyStatuses.isGroqKeySet };
      case 'openrouter':
        return { name: 'openrouterApiKey', isSet: keyStatuses.isOpenrouterKeySet };
      default:
        return { name: '', isSet: false };
    }
  };

  const { name: apiKeyName, isSet: isKeySet } = getApiKeyInfo();

  return (
    <Page title="LLM Settings">
      <Layout>
        {showBanner && <Banner title="Settings saved successfully" tone="success" onDismiss={() => setShowBanner(false)} />}
        {actionData?.error && <Banner title="Error" tone="critical">{actionData.error}</Banner>}
        <Layout.Section>
          <Card>
            <Form method="post">
              <FormLayout>
                <Select
                  label="LLM Provider"
                  name="llmProvider"
                  options={providerOptions}
                  onChange={handleLlmProviderChange}
                  value={llmProvider}
                />
                <TextField
                  label={`${llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)} API Key`}
                  name={apiKeyName}
                  value={apiKey}
                  onChange={setApiKey}
                  autoComplete="off"
                  type="password"
                  placeholder={isKeySet ? '••••••••••••••••••••••••' : 'Enter your API key'}
                  helpText={isKeySet ? 'API key is set. Leave blank to keep the current key.' : ''}
                />
                <Button submit>Save</Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
