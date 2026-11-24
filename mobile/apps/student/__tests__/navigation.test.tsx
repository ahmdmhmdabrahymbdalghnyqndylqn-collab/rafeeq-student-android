import { render } from '@testing-library/react-native';
import HomeScreen from '../app/(tabs)/index';
import { LocaleProvider } from '../lib/locale';

it('renders the student app shell', async () => {
  expect((await render(<LocaleProvider><HomeScreen /></LocaleProvider>)).getByText('Rafeeq')).toBeTruthy();
});
