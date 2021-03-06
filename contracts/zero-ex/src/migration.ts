import { SupportedProvider } from '@0x/subproviders';
import { TxData } from 'ethereum-types';
import * as _ from 'lodash';

import { artifacts } from './artifacts';
import {
    FullMigrationContract,
    InitialMigrationContract,
    MetaTransactionsContract,
    OwnableContract,
    SignatureValidatorContract,
    SimpleFunctionRegistryContract,
    TokenSpenderContract,
    TransformERC20Contract,
    ZeroExContract,
} from './wrappers';

// tslint:disable: completed-docs

/**
 * Addresses of minimum features for a deployment of the Exchange Proxy.
 */
export interface BootstrapFeatures {
    registry: string;
    ownable: string;
}

/**
 * Deploy the minimum features of the Exchange Proxy.
 */
export async function deployBootstrapFeaturesAsync(
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<BootstrapFeatures> = {},
): Promise<BootstrapFeatures> {
    return {
        registry:
            features.registry ||
            (await SimpleFunctionRegistryContract.deployFrom0xArtifactAsync(
                artifacts.SimpleFunctionRegistry,
                provider,
                txDefaults,
                artifacts,
            )).address,
        ownable:
            features.ownable ||
            (await OwnableContract.deployFrom0xArtifactAsync(artifacts.Ownable, provider, txDefaults, artifacts))
                .address,
    };
}

/**
 * Migrate an instance of the Exchange proxy with minimum viable features.
 */
export async function initialMigrateAsync(
    owner: string,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<BootstrapFeatures> = {},
): Promise<ZeroExContract> {
    const migrator = await InitialMigrationContract.deployFrom0xArtifactAsync(
        artifacts.InitialMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await ZeroExContract.deployFrom0xArtifactAsync(
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        migrator.address,
    );
    const _features = await deployBootstrapFeaturesAsync(provider, txDefaults, features);
    await migrator.initializeZeroEx(owner, zeroEx.address, _features).awaitTransactionSuccessAsync();
    return zeroEx;
}

/**
 * Addresses of features for a full deployment of the Exchange Proxy.
 */
export interface FullFeatures extends BootstrapFeatures {
    tokenSpender: string;
    transformERC20: string;
    signatureValidator: string;
    metaTransactions: string;
}

/**
 * Extra configuration options for a full migration of the Exchange Proxy.
 */
export interface FullMigrationOpts {
    transformerDeployer: string;
}

/**
 * Deploy all the features for a full Exchange Proxy.
 */
export async function deployFullFeaturesAsync(
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    zeroExAddress: string,
    features: Partial<FullFeatures> = {},
): Promise<FullFeatures> {
    return {
        ...(await deployBootstrapFeaturesAsync(provider, txDefaults)),
        tokenSpender:
            features.tokenSpender ||
            (await TokenSpenderContract.deployFrom0xArtifactAsync(
                artifacts.TokenSpender,
                provider,
                txDefaults,
                artifacts,
            )).address,
        transformERC20:
            features.transformERC20 ||
            (await TransformERC20Contract.deployFrom0xArtifactAsync(
                artifacts.TransformERC20,
                provider,
                txDefaults,
                artifacts,
            )).address,
        signatureValidator:
            features.signatureValidator ||
            (await SignatureValidatorContract.deployFrom0xArtifactAsync(
                artifacts.SignatureValidator,
                provider,
                txDefaults,
                artifacts,
            )).address,
        metaTransactions:
            features.metaTransactions ||
            (await MetaTransactionsContract.deployFrom0xArtifactAsync(
                artifacts.MetaTransactions,
                provider,
                txDefaults,
                artifacts,
                zeroExAddress,
            )).address,
    };
}

/**
 * Deploy a fully featured instance of the Exchange Proxy.
 */
export async function fullMigrateAsync(
    owner: string,
    provider: SupportedProvider,
    txDefaults: Partial<TxData>,
    features: Partial<FullFeatures> = {},
    opts: Partial<FullMigrationOpts> = {},
): Promise<ZeroExContract> {
    const migrator = await FullMigrationContract.deployFrom0xArtifactAsync(
        artifacts.FullMigration,
        provider,
        txDefaults,
        artifacts,
        txDefaults.from as string,
    );
    const zeroEx = await ZeroExContract.deployFrom0xArtifactAsync(
        artifacts.ZeroEx,
        provider,
        txDefaults,
        artifacts,
        await migrator.getBootstrapper().callAsync(),
    );
    const _features = await deployFullFeaturesAsync(provider, txDefaults, zeroEx.address, features);
    const _opts = {
        transformerDeployer: txDefaults.from as string,
        ...opts,
    };
    await migrator.initializeZeroEx(owner, zeroEx.address, _features, _opts).awaitTransactionSuccessAsync();
    return zeroEx;
}
