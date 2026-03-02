export type ProjectMode = "webnovel" | "literary" | "screenplay";

export type ProjectItem = {
  id: string;
  name: string;
  mode: ProjectMode;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ChapterItem = {
  id: string;
  projectId: string;
  orderNo: number;
  title: string;
  content: string;
  summary?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ApiErrorShape = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorShape;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
