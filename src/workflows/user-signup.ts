import { FatalError, sleep } from 'workflow';

export type User = {
  id: string;
  email: string;
};

export async function handleUserSignup(email: string) {
  "use workflow";

  const user = await createUser(email);
  await sendWelcomeEmail(user);

  await sleep('5s');

  await sendOnboardingEmail(user);

  return { userId: user.id, status: 'onboarded' };
}

async function createUser(email: string): Promise<User> {
  "use step";

  console.log(`Creating user with email: ${email}`);

  return { id: crypto.randomUUID(), email };
}

async function sendWelcomeEmail(user: User) {
  "use step";

  console.log(`Sending welcome email to user: ${user.id}`);

  if (Math.random() < 0.3) {
    throw new Error('Transient email provider error');
  }
}

async function sendOnboardingEmail(user: User) {
  "use step";

  if (!user.email.includes('@')) {
    throw new FatalError('Invalid email');
  }

  console.log(`Sending onboarding email to user: ${user.id}`);
}