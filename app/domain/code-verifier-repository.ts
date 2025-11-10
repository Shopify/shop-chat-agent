export interface CodeVerifierRepository
{
  save(state: string, verifier: string): Promise<object>;
  find(state: string): Promise<object | null>;
}
