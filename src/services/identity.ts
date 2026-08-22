/**
 * 取 KV namespace 用的 userId。
 * v3: 單人使用，不做登入 —— 固定用下面這組 id。
 *
 * 這串是舊版帳號密碼算出來的雜湊，線上資料全都存在 `u:<這串>:...` 底下，
 * 所以直接沿用、不另外換一組，免得既有行程要搬家。
 */

const USER_ID = 'a027ebb481b39a614003191d591dc5bbd370bb7798bc7bb13c39507a57e12a72';

export function getUserId(): string {
  return USER_ID;
}
