import http from "k6/http";
import { check, sleep } from "k6";

const ip = "159.203.54.195";

export const options = {
	vus: 10,
	duration: "1m30s",
};

export default function () {
	const data = { email: "code@yhnl.mozmail.com", password: "password" };
	const headers = { "Content-Type": "application/x-www-form-urlencoded" };
	const res = http.post(`http://${ip}/login`, data, { headers });

	check(res, {
		"success login": (r) => r.status === 200,
		"body size was over 3000 bytes": (res) => res.body.length > 3000,
	});

	sleep(0.3);
}
