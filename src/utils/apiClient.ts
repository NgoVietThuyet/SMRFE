export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

interface FetchOptions extends RequestInit {
    data?: any;
}

export async function apiClient<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { data, headers: customHeaders, ...customConfig } = options;
    const token = getAuthToken();

    const config: RequestInit = {
        method: data ? 'POST' : 'GET',
        body: data ? JSON.stringify(data) : undefined,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...customHeaders,
        },
        ...customConfig,
    };

    const response = await fetch(`/api${endpoint}`, config);

    if (!response.ok) {
        if (response.status === 401) {
            removeAuthToken();
            window.location.reload();
        }
        const errorMessage = await response.text();
        throw new Error(errorMessage || response.statusText);
    }

    const result = await response.json();
    if (result.success === false) {
        throw new Error(result.message || 'API request failed');
    }

    return result.data ?? result;
}
