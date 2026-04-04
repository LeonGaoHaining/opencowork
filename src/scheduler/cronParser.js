// src/scheduler/cronParser.ts
const CRON_REGEX =
  /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|2[0-3])) (\*|([0-2]?\d|3[01])) (\*|(1[2]|[1-9]))$/;
export class CronParser {
  static validate(cronExpression) {
    return CRON_REGEX.test(cronExpression.trim());
  }
  static parse(cronExpression) {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    return {
      min: parts[0],
      hour: parts[1],
      dayOfMonth: parts[2],
      month: parts[3],
      dayOfWeek: parts[4],
    };
  }
  static fromNaturalLanguage(type, value) {
    switch (type) {
      case 'daily': {
        const dailyMatch = value.match(/^(\d{1,2}):(\d{2})$/);
        if (dailyMatch) {
          return `0 ${dailyMatch[1]} * * *`;
        }
        break;
      }
      case 'weekly': {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const weeklyMatch = value.match(/^(\w+)\s+(\d{1,2}):(\d{2})$/);
        if (weeklyMatch) {
          const dayIndex = days.indexOf(weeklyMatch[1].toLowerCase());
          if (dayIndex !== -1) {
            return `0 ${weeklyMatch[2]} * * ${dayIndex}`;
          }
        }
        break;
      }
      case 'monthly': {
        const monthlyMatch = value.match(/^(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (monthlyMatch) {
          return `0 ${monthlyMatch[2]} ${monthlyMatch[1]} * *`;
        }
        break;
      }
      case 'hourly':
        if (value === 'on') {
          return '0 * * * *';
        }
        break;
    }
    return null;
  }
  static getPresets() {
    return [
      { label: '每天 9:00', expression: '0 9 * * *', description: '每天上午 9:00 执行' },
      { label: '每天 18:00', expression: '0 18 * * *', description: '每天下午 6:00 执行' },
      { label: '每周一 9:00', expression: '0 9 * * 1', description: '每周一上午 9:00 执行' },
      { label: '每周五 18:00', expression: '0 18 * * 5', description: '每周五下午 6:00 执行' },
      { label: '每月 1 日 9:00', expression: '0 9 1 * *', description: '每月 1 日上午 9:00 执行' },
      { label: '每小时', expression: '0 * * * *', description: '每小时的整点执行' },
    ];
  }
  static getNextRunTime(cronExpression, fromTime = Date.now()) {
    if (!CronParser.validate(cronExpression)) return null;
    return fromTime + 60000;
  }
}
