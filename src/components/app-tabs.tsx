import { NativeTabs } from 'expo-router/native-tabs';
import { DynamicColorIOS } from 'react-native';

import { palettes } from '@/theme';

import { QuickAddBar } from './quick-add-bar';

const tint =
  process.env.EXPO_OS === 'ios'
    ? DynamicColorIOS({ light: palettes.light.ink, dark: palettes.dark.ink })
    : palettes.light.accent;

function Accessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return <QuickAddBar compact={placement === 'inline'} />;
}

export function AppTabs() {
  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown">
      <NativeTabs.BottomAccessory>
        <Accessory />
      </NativeTabs.BottomAccessory>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="receipt_long" />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budget">
        <NativeTabs.Trigger.Icon sf={{ default: 'tray.2', selected: 'tray.2.fill' }} md="inbox" />
        <NativeTabs.Trigger.Label>Budget</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="debt">
        <NativeTabs.Trigger.Icon sf="chart.line.downtrend.xyaxis" md="trending_down" />
        <NativeTabs.Trigger.Label>Debt</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recurring">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.2.circlepath" md="autorenew" />
        <NativeTabs.Trigger.Label>Recurring</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
