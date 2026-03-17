import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterSidebar from './FilterSidebar';

const BASE_FILTERS = {
  categories: [],
  subcategories: {},
  locations: [],
  channels: [],
  scenes: [],
};

function renderSidebar(filterOverrides = {}, props = {}) {
  const filters = { ...BASE_FILTERS, ...filterOverrides };
  return render(
    <FilterSidebar
      filters={filters}
      activeCategory=""
      activeSubcategory=""
      activeRights=""
      activeLocation=""
      activeMetadataQuality={[]}
      activeChannel={props.activeChannel ?? ''}
      activeScene={props.activeScene ?? []}
      onFilterChange={props.onFilterChange ?? vi.fn()}
    />
  );
}

describe('FilterSidebar — Channel section', () => {
  it('renders a Channel section with two chips when channels=["hero","banner"]', () => {
    renderSidebar({ channels: ['hero', 'banner'] });
    expect(screen.getByText('Channel')).toBeInTheDocument();
    // Section starts collapsed — click to open
    fireEvent.click(screen.getByText('Channel'));
    expect(screen.getByText('hero')).toBeInTheDocument();
    expect(screen.getByText('banner')).toBeInTheDocument();
  });

  it('does not render a Channel section when channels=[]', () => {
    renderSidebar({ channels: [] });
    expect(screen.queryByText('Channel')).not.toBeInTheDocument();
  });

  it('clicking a channel chip calls onFilterChange with key="channel" and the chip value', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ channels: ['hero', 'banner'] }, { onFilterChange });
    // Open the section
    fireEvent.click(screen.getByText('Channel'));
    fireEvent.click(screen.getByText('hero'));
    expect(onFilterChange).toHaveBeenCalledWith('channel', 'hero');
  });

  it('clicking an active channel chip deselects it (calls onFilterChange with empty string)', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ channels: ['hero', 'banner'] }, { activeChannel: 'hero', onFilterChange });
    fireEvent.click(screen.getByText('Channel'));
    fireEvent.click(screen.getByText('hero'));
    expect(onFilterChange).toHaveBeenCalledWith('channel', '');
  });
});

describe('FilterSidebar — Scene / Mood section', () => {
  it('renders a Scene / Mood section when scenes is non-empty', () => {
    renderSidebar({ scenes: ['sunset', 'aerial'] });
    expect(screen.getByText('Scene / Mood')).toBeInTheDocument();
  });

  it('does not render a Scene / Mood section when scenes=[]', () => {
    renderSidebar({ scenes: [] });
    expect(screen.queryByText('Scene / Mood')).not.toBeInTheDocument();
  });

  it('clicking a scene chip toggles it via onFilterChange with key="scene"', () => {
    const onFilterChange = vi.fn();
    renderSidebar({ scenes: ['sunset', 'aerial'] }, { onFilterChange });
    fireEvent.click(screen.getByText('Scene / Mood'));
    fireEvent.click(screen.getByText('sunset'));
    expect(onFilterChange).toHaveBeenCalledWith('scene', ['sunset']);
  });
});

describe('FilterSidebar — no channels/scenes (negative case)', () => {
  it('renders identically to before enrichment when API returns no channels or scenes', () => {
    renderSidebar({ channels: [], scenes: [] });
    expect(screen.queryByText('Channel')).not.toBeInTheDocument();
    expect(screen.queryByText('Scene / Mood')).not.toBeInTheDocument();
    // Existing sections still present
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Rights Status')).toBeInTheDocument();
    expect(screen.getByText('Metadata Quality')).toBeInTheDocument();
  });
});
