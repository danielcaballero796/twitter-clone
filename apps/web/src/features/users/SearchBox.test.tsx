import { fireEvent, render, screen } from '@testing-library/react';
import SearchBox from './SearchBox';

describe('SearchBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the search after the debounce interval, not per keystroke', () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);

    const input = screen.getByRole('textbox', { name: /search users/i });

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.change(input, { target: { value: 'ali' } });

    // No call yet — each keystroke should have reset the pending timer.
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('ali');
  });
});
