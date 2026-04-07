'use client';

import React, { useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import BoardDetail from '../board-entity/board-detail';
import BoardSearchResults from '../social/board-search-results';
import { useMyBoards } from '@/app/hooks/use-my-boards';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';
import type { UserBoard } from '@boardsesh/shared-schema';
import styles from './my-boards-drawer.module.css';

interface MyBoardsDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreateBoard?: () => void;
}

export default function MyBoardsDrawer({ open, onClose, onCreateBoard }: MyBoardsDrawerProps) {
  const { boards, isLoading, error } = useMyBoards(open);
  const { token } = useWsAuthToken();
  const [selectedBoardUuid, setSelectedBoardUuid] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleBoardDeleted = useCallback(() => {
    setSelectedBoardUuid(null);
  }, []);

  const formatBoardMeta = (board: UserBoard) => {
    const parts: string[] = [];
    parts.push(board.boardType.charAt(0).toUpperCase() + board.boardType.slice(1));
    if (board.locationName) parts.push(board.locationName);
    if (board.angle != null) parts.push(`${board.angle}\u00B0`);
    return parts.join(' \u00B7 ');
  };

  const headerActions = (
    <>
      <IconButton
        size="small"
        onClick={() => setShowSearch(true)}
        aria-label="Find a board"
      >
        <SearchOutlined fontSize="small" />
      </IconButton>
      {onCreateBoard && (
        <IconButton
          size="small"
          onClick={onCreateBoard}
          aria-label="Create a board"
        >
          <AddOutlined fontSize="small" />
        </IconButton>
      )}
    </>
  );

  return (
    <>
      <SwipeableDrawer
        title="My Boards"
        placement="bottom"
        open={open}
        onClose={onClose}
        height="85dvh"
        extra={headerActions}
      >
        {error && boards.length === 0 ? (
          <div className={styles.emptyState} data-testid="my-boards-error">
            <Alert severity="error" sx={{ width: '100%' }}>
              {error}
            </Alert>
          </div>
        ) : isLoading && boards.length === 0 ? (
          <div className={styles.loadingState} data-testid="my-boards-loading">
            <CircularProgress size={32} />
          </div>
        ) : boards.length === 0 ? (
          <div className={styles.emptyState} data-testid="my-boards-empty">
            <DashboardOutlined sx={{ fontSize: 48, color: 'var(--neutral-300)' }} />
            <Typography variant="body2" color="text.secondary">
              No boards yet. Create one from the board selector to get started.
            </Typography>
          </div>
        ) : (
          <div className={styles.boardList} data-testid="my-boards-list">
            {boards.map((board) => (
              <button
                type="button"
                key={board.uuid}
                className={styles.boardItem}
                onClick={() => setSelectedBoardUuid(board.uuid)}
                data-testid={`board-item-${board.uuid}`}
              >
                <div className={styles.boardItemIcon}>
                  <DashboardOutlined />
                </div>
                <div className={styles.boardItemInfo}>
                  <div className={styles.boardItemName}>{board.name}</div>
                  <div className={styles.boardItemMeta}>
                    {formatBoardMeta(board)}
                  </div>
                </div>
                <ChevronRightOutlined className={styles.boardItemAction} />
              </button>
            ))}
          </div>
        )}
      </SwipeableDrawer>

      <SwipeableDrawer
        title="Find a Board"
        placement="bottom"
        open={showSearch}
        onClose={() => {
          setShowSearch(false);
          setSearchQuery('');
        }}
        height="90dvh"
        styles={{ body: { padding: 0 } }}
      >
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="Search by name or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ px: 2, pt: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        <BoardSearchResults query={searchQuery} authToken={token} />
      </SwipeableDrawer>

      {selectedBoardUuid && (
        <BoardDetail
          boardUuid={selectedBoardUuid}
          open
          onClose={() => setSelectedBoardUuid(null)}
          onDeleted={handleBoardDeleted}
        />
      )}
    </>
  );
}
