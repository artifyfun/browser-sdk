import React, { useState } from 'react'
import { Tabs, Text } from '@mantine/core'
import { datadogRum } from '@datadog/browser-rum'

import { useEvents } from '../hooks/useEvents'
import { useAutoFlushEvents } from '../hooks/useAutoFlushEvents'
import { useNetworkRules } from '../hooks/useNetworkRules'
import { useSettings } from '../hooks/useSettings'
import { DEFAULT_PANEL_TAB, PanelTabs } from '../../common/constants'
import type { Settings } from '../../common/types'
import { SettingsTab } from './tabs/settingsTab'
import { InfosTab } from './tabs/infosTab'
import { EventsTab, DEFAULT_COLUMNS } from './tabs/eventsTab'
import { VulnerabilitiesTab, DEFAULT_VULNERABILITIES_COLUMNS } from './tabs/vulnerabilitiesTab'
import { ReplayTab } from './tabs/replayTab'

import classes from './panel.module.css'
import { useVulnerabilities } from '../hooks/useVulnerabilities'

export function Panel() {
  const [settings] = useSettings()

  useAutoFlushEvents(settings.autoFlush)
  useNetworkRules(settings)

  const { events, filters, setFilters, clear, facetRegistry } = useEvents(settings)

  const [columns, setColumns] = useState(DEFAULT_COLUMNS)

  const { vulnerabilities, clearVulnerabilities } = useVulnerabilities(settings)
  const [vulnerabilitiesColumns, setVulnerabilitiesColumns] = useState(DEFAULT_VULNERABILITIES_COLUMNS)

  const [activeTab, setActiveTab] = useState<string | null>(DEFAULT_PANEL_TAB)
  function updateActiveTab(activeTab: string | null) {
    setActiveTab(activeTab)
    activeTab && datadogRum.startView(activeTab)
  }

  return (
    <Tabs color="violet" value={activeTab} className={classes.tabs} onChange={updateActiveTab}>
      <Tabs.List className="dd-privacy-allow">
        <Tabs.Tab value={PanelTabs.Vulnerabilities}>Vulnerabilities</Tabs.Tab>
        <Tabs.Tab value={PanelTabs.Events}>Events</Tabs.Tab>
        <Tabs.Tab
          value={PanelTabs.Infos}
          rightSection={
            isOverridingInitConfiguration(settings) && (
              <Text c="orange" fw="bold" title="Overriding init configuration">
                ⚠
              </Text>
            )
          }
        >
          <Text>Infos</Text>
        </Tabs.Tab>
        <Tabs.Tab value={PanelTabs.Replay}>
          <Text>Live replay</Text>
        </Tabs.Tab>
        <Tabs.Tab
          value={PanelTabs.Settings}
          rightSection={
            isInterceptingNetworkRequests(settings) && (
              <Text c="orange" fw="bold" title="Intercepting network requests">
                ⚠
              </Text>
            )
          }
        >
          Settings
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={PanelTabs.Vulnerabilities} className={classes.tab}>
        <VulnerabilitiesTab
          vulnerabilities={vulnerabilities}
          columns={vulnerabilitiesColumns}
          clear={clearVulnerabilities}
        />
      </Tabs.Panel>
      <Tabs.Panel value={PanelTabs.Events} className={classes.tab}>
        <EventsTab
          events={events}
          facetRegistry={facetRegistry}
          filters={filters}
          onFiltersChange={setFilters}
          columns={columns}
          onColumnsChange={setColumns}
          clear={clear}
        />
      </Tabs.Panel>
      <Tabs.Panel value={PanelTabs.Infos} className={classes.tab}>
        <InfosTab />
      </Tabs.Panel>
      <Tabs.Panel value={PanelTabs.Replay} className={classes.tab}>
        <ReplayTab />
      </Tabs.Panel>
      <Tabs.Panel value={PanelTabs.Settings} className={classes.tab}>
        <SettingsTab />
      </Tabs.Panel>
    </Tabs>
  )
}

function isInterceptingNetworkRequests(settings: Settings) {
  return settings.blockIntakeRequests || settings.useDevBundles || settings.useRumSlim
}

function isOverridingInitConfiguration(settings: Settings) {
  return settings.rumConfigurationOverride || settings.logsConfigurationOverride
}
