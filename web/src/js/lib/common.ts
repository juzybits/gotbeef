/// Miscellaneous convenience functions and constants

export const isDev = window.location.hostname=='localhost' || window.location.hostname.includes('dev');
export const isProd = !isDev;

/// Transform a long string like "startXXXXXXend" into "start...end"
export function shorten(text: string, start=5, end=3, separator='...'): string {
    return !text ? '' : text.slice(0, start) + separator + text.slice(-end);
}

/// Get a date in relative time, e.g. "5 days ago"
/// Copied from sui/apps/explorer/src/utils/timeUtils.ts
export const timeAgo = (
    epochMilliSecs: number | null | undefined,
    timeNow?: number,
    shortenTimeLabel: boolean = true
): string => {
    if (!epochMilliSecs) return '';

    timeNow = timeNow ? timeNow : Date.now();

    const timeLabel = {
        year: {
            full: 'year',
            short: 'y',
        },
        month: {
            full: 'month',
            short: 'm',
        },
        day: {
            full: 'day',
            short: 'd',
        },
        hour: {
            full: 'hour',
            short: 'h',
        },
        min: {
            full: 'min',
            short: 'm',
        },
        sec: {
            full: 'sec',
            short: 's',
        },
    };
    const dateKeyType = shortenTimeLabel ? 'short' : 'full';

    let timeUnit: [string, number][];
    let timeCol = timeNow - epochMilliSecs;

    if (timeCol >= 1000 * 60 * 60 * 24) {
        timeUnit = [
            [timeLabel.day[dateKeyType], 1000 * 60 * 60 * 24],
            [timeLabel.hour[dateKeyType], 1000 * 60 * 60],
        ];
    } else if (timeCol >= 1000 * 60 * 60) {
        timeUnit = [
            [timeLabel.hour[dateKeyType], 1000 * 60 * 60],
            [timeLabel.min[dateKeyType], 1000 * 60],
        ];
    } else {
        timeUnit = [
            [timeLabel.min[dateKeyType], 1000 * 60],
            [timeLabel.sec[dateKeyType], 1000],
        ];
    }

    const convertAmount = (amount: number, label: string) => {
        const spacing = shortenTimeLabel ? '' : ' ';
        if (amount > 1)
            return `${amount}${spacing}${label}${!shortenTimeLabel ? 's' : ''}`;
        if (amount === 1) return `${amount}${spacing}${label}`;
        return '';
    };

    const resultArr = timeUnit.map(([label, denom]) => {
        const whole = Math.floor(timeCol / denom);
        timeCol = timeCol - whole * denom;
        return convertAmount(whole, label);
    });

    const result = resultArr.join(' ').trim();

    return result ? result : `< 1s`;
};
