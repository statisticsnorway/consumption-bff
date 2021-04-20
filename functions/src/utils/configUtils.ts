const protectSecretValue = (val: string) =>
    val && `${val.slice(0, 5)} .. ${val.slice(-5)}`;

export type ConfigType = {
    [key: string]: string;
};

export const sanitizeConfig = (config: ConfigType) =>
    Object.keys(config)
        .reduce((acc, key) => ({
            ...acc,
            [key]: protectSecretValue(config[key]),
        }), {});
