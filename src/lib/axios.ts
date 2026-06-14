import axios from "axios";

/** Event dispatched when any API call returns a 503 maintenance response. */
export const MAINTENANCE_EVENT = "kolayrapor-maintenance";

export interface MaintenanceDetail {
  message?: string;
  endsAt?: string | null;
}

const apiClient = axios.create({
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    // The maintenance guard returns 503 with { maintenance: true, message, endsAt }.
    if (status === 503 && data?.maintenance === true) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent<MaintenanceDetail>(MAINTENANCE_EVENT, {
            detail: { message: data.message, endsAt: data.endsAt ?? null },
          }),
        );
      }
    } else {
      console.error("Response Error:", status, data);
    }
    return Promise.reject(error);
  },
);

export { apiClient };
