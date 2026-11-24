import { render, waitFor } from '@testing-library/react-native';
import OverviewScreen from '../app/(tabs)/index';
import { AdminAuthProvider } from '../lib/admin-auth';

it('renders the admin shell', async () => {
  const screen = await render(<AdminAuthProvider><OverviewScreen /></AdminAuthProvider>);
  expect(screen.getByText('Rafeeq Admin')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Supabase is not configured.')).toBeTruthy());
});
