import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  return login(request);
};
