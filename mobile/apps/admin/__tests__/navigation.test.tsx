import { render } from '@testing-library/react-native';
import OverviewScreen from '../app/(tabs)/index';

it('renders the admin shell', async () => {
  expect((await render(<OverviewScreen />)).getByText('Rafeeq Admin')).toBeTruthy();
});
