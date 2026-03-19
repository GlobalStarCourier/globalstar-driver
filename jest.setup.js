import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import * as matchers from '@testing-library/react-native/matchers';

expect.extend(matchers);
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
