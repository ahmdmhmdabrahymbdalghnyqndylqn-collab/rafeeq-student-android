import { render } from '@testing-library/react-native';
import HomeScreen from '../app/(tabs)/index';
import { AuthProvider } from '../lib/auth';
import { LocaleProvider } from '../lib/locale';

it('renders the student app shell', async () => {
  expect((await render(<LocaleProvider><AuthProvider><HomeScreen /></AuthProvider></LocaleProvider>)).getByText('Rafeeq')).toBeTruthy();
});
