import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Space } from 'antd';
import { openUrl } from '@tauri-apps/plugin-opener';
import { platformHomeUrl, platformLabel } from '@/config/platformPresets';
import { invoke } from '@/hooks/useTauri';
import type { PlatformAccount, VaultStatus } from '@/types';
import CabinX, { type CabinXColumn } from '@/components/CabinX';
import { formatTime } from '@/utils/time';
import { AccountModal } from './components/AccountModal';
import { RevealSecretsModal } from './components/RevealSecretsModal';
import { VaultPasswordModal } from './components/VaultPasswordModal';

const maskHint = (has: boolean | undefined, encrypted?: boolean) => {
    if (!has) return '—';
    return encrypted ? '••••••（加密）' : '••••••';
};

export const AccountsPage = () => {
    const [refreshKey, setRefreshKey] = useState(0);
    const [vault, setVault] = useState<VaultStatus>({ configured: false, unlocked: false });
    const [mode, setMode] = useState<'idle' | 'add' | 'edit'>('idle');
    const [editing, setEditing] = useState<PlatformAccount | null>(null);
    const [revealFor, setRevealFor] = useState<PlatformAccount | null>(null);
    const [vaultModal, setVaultModal] = useState<'unlock' | null>(null);

    const refreshVault = useCallback(async () => {
        const s = await invoke<VaultStatus>('vault_status');
        setVault(s);
    }, []);

    useEffect(() => {
        void refreshVault().catch(console.error);
    }, [refreshVault]);

    const api = useMemo(() => ({
        paging: async (params: any) => {
            void refreshKey;
            let list = await invoke<PlatformAccount[]>('account_list');
            if (params?.platform?.trim()) {
                const p = params.platform.trim().toLowerCase();
                list = list.filter(a => a.platform.toLowerCase().includes(p));
            }
            if (params?.name?.trim()) {
                const q = params.name.trim().toLowerCase();
                list = list.filter(a =>
                    [a.name, a.platform, a.phone, a.email, a.account_id, a.notes]
                        .join(' ')
                        .toLowerCase()
                        .includes(q),
                );
            }
            return { list, total: list.length, pageNum: 1, pageSize: Math.max(list.length, 10) };
        },
    }), [refreshKey]);

    const lockVault = async () => {
        const s = await invoke<VaultStatus>('vault_lock');
        setVault(s);
    };

    const toggleEnabled = async (a: PlatformAccount) => {
        await invoke('account_update', {
            id: a.id,
            name: a.name,
            platform: a.platform,
            phone: a.phone || '',
            email: a.email || '',
            accountId: a.account_id,
            accessKey: '',
            secretKey: '',
            enabled: !a.enabled,
            notes: a.notes,
            updateSecrets: false,
        });
        setRefreshKey(k => k + 1);
    };

    const removeAccount = async (a: PlatformAccount) => {
        if (!window.confirm('确定删除该账号记录？')) return;
        await invoke('account_remove', { id: a.id });
        setRefreshKey(k => k + 1);
    };

    const columns: CabinXColumn<PlatformAccount>[] = [
        {
            title: '平台',
            dataIndex: 'platform',
            key: 'platform',
            search: { name: 'platform', label: '平台', type: 'input', placeholder: '筛选平台' },
            render: (platform: string) => {
                const url = platformHomeUrl(platform);
                const label = platformLabel(platform) || platform || '—';
                if (url) {
                    return (
                        <button
                            type="button"
                            className="account-platform-link"
                            onClick={() => void openUrl(url)}
                        >
                            {label} ↗
                        </button>
                    );
                }
                return <span>{label}</span>;
            },
        },
        {
            title: '用户名',
            dataIndex: 'name',
            key: 'name',
            search: { name: 'name', label: '关键词', type: 'input', placeholder: '搜索用户名、手机、邮箱…' },
            render: (name: string) => <span className="model-table__name">{name}</span>,
        },
        {
            title: '手机号',
            dataIndex: 'phone',
            key: 'phone',
            render: (v: string) => <span className="model-table__mono">{v || '—'}</span>,
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            key: 'email',
            render: (v: string) => <span className="model-table__mono">{v || '—'}</span>,
        },
        {
            title: '公钥',
            dataIndex: 'account_id',
            key: 'account_id',
            render: (v: string) => <span className="model-table__mono">{v || '—'}</span>,
        },
        {
            title: '密码',
            dataIndex: 'has_access_key',
            key: 'has_access_key',
            render: (_: any, record: PlatformAccount) => (
                <span className="model-table__mono">
                    {maskHint(record.has_access_key, record.secrets_encrypted)}
                </span>
            ),
        },
        {
            title: '私钥',
            dataIndex: 'has_secret_key',
            key: 'has_secret_key',
            render: (_: any, record: PlatformAccount) => (
                <span className="model-table__mono">
                    {maskHint(record.has_secret_key, record.secrets_encrypted)}
                </span>
            ),
        },
        {
            title: '备注',
            dataIndex: 'notes',
            key: 'notes',
            render: (v: string) => <span className="account-table__notes">{v || '—'}</span>,
        },
        {
            title: '状态',
            dataIndex: 'enabled',
            key: 'enabled',
            render: (enabled: boolean) =>
                enabled
                    ? <span className="model-badge">启用</span>
                    : <span className="model-status-idle">停用</span>,
        },
        {
            title: '更新',
            dataIndex: 'updated',
            key: 'updated',
            render: (ms: number) => formatTime(ms),
        },
        {
            title: '操作',
            dataIndex: '__actions',
            key: '__actions',
            render: (_: any, record: PlatformAccount) => (
                <Space size={2}>
                    <Button
                        type="link"
                        onClick={() => {
                            if (vault.configured && !vault.unlocked) {
                                setRevealFor(record);
                                setVaultModal('unlock');
                                return;
                            }
                            setRevealFor(record);
                        }}
                    >
                        查看
                    </Button>
                    <Button
                        type="link"
                        onClick={() => void toggleEnabled(record)}
                    >
                        {record.enabled ? '停用' : '启用'}
                    </Button>
                    <Button
                        type="link"
                        onClick={() => { setEditing(record); setMode('edit'); }}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        danger
                        onClick={() => void removeAccount(record)}
                    >
                        移除
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <div className="page page-scroll">
            {vault.configured && (
                <div className="account-vault-bar">
                    {vault.unlocked ? (
                        <>
                            <span className="account-vault-bar__text account-vault-bar__text--ok">
                                保险柜已解锁（约 30 分钟内可查看敏感信息）
                            </span>
                            <Button onClick={() => void lockVault()}>锁定</Button>
                        </>
                    ) : (
                        <>
                            <span className="account-vault-bar__text">
                                保险柜已锁定，查看密码/私钥前请解锁
                            </span>
                            <Button type="primary" onClick={() => setVaultModal('unlock')}>解锁</Button>
                        </>
                    )}
                </div>
            )}

            <CabinX
                api={api}
                columns={columns}
                pageTitle="账号管理"
                rowKey="id"
                showActionColumn={false}
                headerActions={null}
                extraHeaderActions={
                    <Button type="primary" onClick={() => { setEditing(null); setMode('add'); }}>
                        新增账号
                    </Button>
                }
            />

            {mode !== 'idle' && (
                <AccountModal
                    mode={mode}
                    account={editing}
                    vault={vault}
                    onVaultChange={setVault}
                    onClose={() => { setMode('idle'); setEditing(null); }}
                    onSaved={async () => {
                        setMode('idle');
                        setEditing(null);
                        setRefreshKey(k => k + 1);
                        await refreshVault();
                    }}
                />
            )}

            {revealFor && (vault.unlocked || !vault.configured) && (
                <RevealSecretsModal
                    account={revealFor}
                    onClose={() => setRevealFor(null)}
                    onNeedUnlock={() => setVaultModal('unlock')}
                />
            )}

            {vaultModal && (
                <VaultPasswordModal
                    mode="unlock"
                    onClose={() => setVaultModal(null)}
                    onDone={(s) => {
                        setVault(s);
                        setVaultModal(null);
                        setRefreshKey(k => k + 1);
                    }}
                />
            )}
        </div>
    );
};
