import { describe, expect, it } from 'vitest';
import type { ApiDevice } from './api';
import { pickDevice } from './devices';

const device = (id: string, type: string, extra: Partial<ApiDevice> = {}): ApiDevice => ({
  id,
  type,
  name: id,
  is_active: false,
  is_restricted: false,
  ...extra,
});

describe('pickDevice', () => {
  const phone = { preferTypes: ['Smartphone', 'Tablet'] };

  it('kiest een actief apparaat als dat er is', () => {
    expect(pickDevice([device('tv', 'TV', { is_active: true }), device('iphone', 'Smartphone')], phone)?.id).toBe('tv');
  });

  it('kiest op de telefoon het laatst gebruikte telefoon-apparaat', () => {
    const devices = [device('oud', 'Smartphone'), device('laatst', 'Smartphone')];
    expect(pickDevice(devices, { ...phone, lastDeviceId: 'laatst' })?.id).toBe('laatst');
    expect(pickDevice(devices, phone)?.id).toBe('oud');
  });

  it('start nooit vanzelf een speaker, tv of ander soort apparaat', () => {
    expect(pickDevice([device('speaker', 'Speaker'), device('tv', 'TV'), device('pc', 'Computer')], phone)).toBeNull();
  });

  it('slaat apparaten over die niet bediend mogen worden', () => {
    expect(pickDevice([device('iphone', 'Smartphone', { is_restricted: true })], phone)).toBeNull();
  });

  it('gebruikt op de computer de eigen browser-speler', () => {
    const devices = [device('laptop-app', 'Computer'), device('browser', 'Computer')];
    expect(pickDevice(devices, { preferTypes: ['Computer'], ownDeviceId: 'browser' })?.id).toBe('browser');
  });
});
