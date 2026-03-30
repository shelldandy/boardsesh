import React from 'react';
import { getServerAuthToken } from './lib/auth/server-auth';
import ConsolidatedBoardConfig from './components/setup-wizard/consolidated-board-config';
import { getAllBoardConfigs } from './lib/server-board-configs';
import HomePageContent from './home-page-content';

type HomeProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const boardConfigs = await getAllBoardConfigs();

  // Check if user explicitly wants to see the board selector
  if (params.select === 'true') {
    return <ConsolidatedBoardConfig boardConfigs={boardConfigs} />;
  }

  // Read auth cookie to determine if user is authenticated at SSR time
  const authToken = await getServerAuthToken();
  const isAuthenticatedSSR = !!authToken;

  return (
    <HomePageContent
      boardConfigs={boardConfigs}
      isAuthenticatedSSR={isAuthenticatedSSR}
    />
  );
}
