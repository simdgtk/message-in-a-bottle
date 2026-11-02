<template>
  <section class="min-h-screen bg-gray-50 p-6 dark:bg-gray-900 sm:p-12">
    <div class="mx-auto max-w-5xl space-y-8 rounded-lg bg-white p-8 shadow dark:bg-gray-800 dark:text-white">
      <h1 class="text-2xl font-bold">Hello {{ name }}, you have {{ balance }} currency !</h1>

      <form class="space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700" @submit.prevent="onSubmit">
        <div>
          <label for="destination" class="mb-2 block text-sm font-medium">Destination</label>
          <select
            id="destination"
            v-model="destination"
            :disabled="loading"
            required
            class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 dark:border-gray-600 dark:bg-gray-700"
          >
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.username }}
            </option>
          </select>
        </div>
        <div>
          <label for="amount" class="mb-2 block text-sm font-medium">Amount</label>
          <input
            id="amount"
            v-model.number="amount"
            type="number"
            :disabled="loading"
            required
            class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
        <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          Transfer Currency
        </button>
      </form>

      <div class="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h2 class="mb-4 text-xl font-bold">List of users</h2>
        <table class="w-full text-left text-sm">
          <thead class="border-b border-gray-200 uppercase dark:border-gray-700">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in users" :key="item.id" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2">{{ item.username }}</td>
              <td class="py-2">{{ item.id }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="border-t border-gray-200 pt-6 dark:border-gray-700">
        <h2 class="mb-4 text-xl font-bold">List of transfers</h2>
        <table class="w-full text-left text-sm">
          <thead class="border-b border-gray-200 uppercase dark:border-gray-700">
            <tr>
              <th class="py-2">Source</th>
              <th class="py-2">Destination</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in transfers" :key="item.execution_date" class="border-b border-gray-100 dark:border-gray-700">
              <td class="py-2">{{ item.source }}</td>
              <td class="py-2">{{ item.destination }}</td>
              <td class="py-2">{{ item.amount }}</td>
              <td class="py-2">{{ item.execution_date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script>
import axios from 'axios'
import { router } from '@/router/index'

export default {

  data() {
    return {
      users: [],
      transfers: [],
      name: "placeholder",
      balance: 0,
      loading: false,
      error: "",
      destination: 0,
      amount: 0
    }
  },

  methods: {
    fetchAllUsers: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/users', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.users = []
        resp.data.forEach( x => this.users.push(x))
        this.destination = resp.data[0].id
      }).catch(()=> { console.log('--- ERROR USERS ---') })
    },
    fetchAllTransfers: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/transfers', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.transfers = []
        resp.data.forEach( x => this.transfers.push(x))
      }).catch(()=> { console.log('--- ERROR TRANSFERS ---') })
    },
    fetchMe: function () {
      let token = localStorage.getItem('thunes_token');
      axios.get('http://localhost:4000/me', { headers: {"Authorization" : `Bearer ${token}`} }).then( resp => {
        this.name = resp.data.username
        this.balance = resp.data.balance
      }).catch(error => {
        console.log('--- ERROR ME ---')
          if (error.response.status === 401) {
            this.error = "Unauthorized"
	  	      router.push('/login');
          }
      })
    },
    onSubmit() {
      this.loading = true
      this.error = ""

      let token = localStorage.getItem('thunes_token');

      axios.post('http://localhost:4000/transfers', {
        destination_id: this.destination,
        amount: this.amount,
      }, {
        headers: {"Authorization" : `Bearer ${token}`}
      })
      .then(response => {
        this.fetchAllTransfers()
        this.fetchMe()
      })
      .catch(error => {
        if (error.response.status !== 200) {
          if (error.response.status === 401) {
            this.error = "Unauthorized"
	  	      router.push('/login');
          }

          if (error.response.status === 500) {
            //primitive i19n
            let code = error.response.data
            if (code == "transfer_to_itself") {
              this.error = "Can't transfer to yourself"
            } else if (code == "not_enough_money") {
              this.error = "Insufficient funds"
            } else if (code == "negative_nul_amount") {
              this.error = "Must transfer a positive amount of currency"
            } else {
              this.error = "Internal Server Error"
            }
          }
        }
      })
      .finally(() => {
        this.loading = false
      });
    },
  },
  beforeMount() {
     this.fetchAllUsers()
     this.fetchAllTransfers()
     this.fetchMe()
  },
};
</script>
