
import { test, expect, type Page } from '@playwright/test';

// Testlerde kullanılacak sahte hasta
const testPatient = {
    id: 'test-patient-1',
    tc_no: '10000000001',
    first_name: 'Ayşe',
    last_name: 'Test',
    date_of_birth: '1985-05-12',
    gender: 'Kadın',
    phone: '+905321234567',
    email: 'ayse.test@example.com',
    address: 'İstanbul',
    blood_type: 'A Rh+',
    allergies: 'Yok',
    chronic_diseases: 'Yok',
    family_history_of_cancer: false,
    created_at: '2026-11-28T10:00:00.000Z',
};

async function prepareAuthenticatedPage(page: Page) {
    // Gerçek doktor hesabı yerine test oturumu
    await page.addInitScript(() => {
        localStorage.setItem('mammovisionai_token', 'playwright-test-token');
        localStorage.setItem(
            'mammovisionai_doctor',
            JSON.stringify({
                id: 'test-doctor-1',
                email: 'test@example.com',
                full_name: 'Test Doktor',
                title: 'Dr.',
                specialty: 'Radyoloji',
            })
        );
    });

    // API isteklerini sahte yanıtlarla karşıla
    const patients = [{ ...testPatient }];

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const method = request.method();

        if (path === '/api/auth/me') {
            return route.fulfill({
                json: {
                    doctor: {
                        id: 'test-doctor-1',
                        email: 'test@example.com',
                        full_name: 'Test Doktor',
                        title: 'Dr.',
                        specialty: 'Radyoloji',
                    },
                },
            });
        }

        if (path === '/api/notifications') {
            return route.fulfill({
                json: {
                    unread_count: 0,
                    notifications: [],
                },
            });
        }

        if (path === '/api/notifications/stream') {
            return route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: '',
            });
        }

        if (path === '/api/patients' && method === 'GET') {
            const query = url.searchParams.get('q')?.toLocaleLowerCase('tr-TR') || '';

            const filteredPatients = patients.filter((patient) =>
                `${patient.first_name} ${patient.last_name} ${patient.tc_no}`
                    .toLocaleLowerCase('tr-TR')
                    .includes(query)
            );

            return route.fulfill({
                json: { patients: filteredPatients },
            });
        }

        if (path === '/api/patients' && method === 'POST') {
            const body = request.postDataJSON();

            const newPatient = {
                ...body,
                id: 'test-patient-created',
                created_at: '2026-11-28T10:00:00.000Z',
            };

            patients.push(newPatient);

            return route.fulfill({
                status: 201,
                json: { patient: newPatient },
            });
        }

        if (path.startsWith('/api/patients/') && method === 'PUT') {
            const id = path.split('/').pop();
            const index = patients.findIndex((patient) => patient.id === id);

            if (index !== -1) {
                patients[index] = {
                    ...patients[index],
                    ...request.postDataJSON(),
                };
            }

            return route.fulfill({
                json: {
                    message: 'Hasta güncellendi',
                    patient: patients[index],
                },
            });
        }

        if (path.startsWith('/api/patients/') && method === 'DELETE') {
            const id = path.split('/').pop();
            const index = patients.findIndex((patient) => patient.id === id);

            if (index !== -1) {
                patients.splice(index, 1);
            }

            return route.fulfill({
                json: { message: 'Hasta silindi' },
            });
        }

        // Diğer API istekleri için güvenli varsayılan yanıt
        return route.fulfill({
            json: {},
        });
    });
}

test('Oturum açılmamış kullanıcı hasta sayfasına erişemez', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard/patients');

    await expect(page).toHaveURL(/\/login$/);
});

test('Hasta sayfası açılır ve hasta listesi görüntülenir', async ({ page }) => {
    await prepareAuthenticatedPage(page);

    await page.goto('http://localhost:5173/dashboard/patients');

    await expect(
        page.getByRole('heading', { name: 'Hastalar & Vakalar' })
    ).toBeVisible();

    await expect(page.getByText('Ayşe Test')).toBeVisible();
});

test('Yeni hasta kayıt formu açılır', async ({ page }) => {
    await prepareAuthenticatedPage(page);

    await page.goto('http://localhost:5173/dashboard/patients');

    await page.getByRole('button', { name: 'Yeni Hasta' }).click();

    await expect(
        page.getByRole('heading', { name: 'Yeni Hasta Kaydı' })
    ).toBeVisible();

    await expect(page.getByPlaceholder('Örn: Ayşe')).toBeVisible();
    await expect(page.getByPlaceholder('Örn: Kaya')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Hastayı Kaydet' })
    ).toBeVisible();
});

test('Yeni hasta sahte API üzerinden kaydedilir', async ({ page }) => {
    await prepareAuthenticatedPage(page);

    await page.goto('http://localhost:5173/dashboard/patients');

    await page.getByRole('button', { name: 'Yeni Hasta' }).click();

    await page.getByPlaceholder('12345678901').fill('10000000001');
    await page.getByPlaceholder('Örn: Ayşe').fill('Mehmet');
    await page.getByPlaceholder('Örn: Kaya').fill('Deneme');

    await page.getByRole('button', { name: 'Hastayı Kaydet' }).click();

    await expect(page.getByText('Mehmet Deneme', { exact: true })).toBeVisible();
});