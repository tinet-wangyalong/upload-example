// xhr
interface Request {
  url: string;
  method?: string;
  data?: any;
  headers?: Record<string, string>;
  onProgress?: (e: ProgressEvent) => void;
  requestList?: any[];
}

export const request = ({
  url,
  method = "post",
  data,
  headers = {},
  onProgress = (e) => e,
  requestList,
}: Request): Promise<{ data: any }> => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = onProgress;
    xhr.open(method, url);
    Object.keys(headers).forEach((key) =>
      xhr.setRequestHeader(key, headers[key])
    );
    xhr.send(data);
    xhr.onload = (e: any) => {
      // 将请求成功的 xhr 从列表中删除
      // remove xhr which status is success
      if (requestList) {
        const xhrIndex = requestList.findIndex((item) => item === xhr);
        requestList.splice(xhrIndex, 1);
      }
      resolve({
        data: e.target.response,
      });
    };
    // 暴露当前 xhr 给外部
    // export xhr
    requestList?.push(xhr);
  });
};
